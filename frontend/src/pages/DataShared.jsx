import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { requirementsAPI, clientsAPI, projectsAPI, tasksAPI, uploadAPI } from '../services/api';
import { 
  Share2, 
  FileText, 
  Download, 
  User, 
  Calendar,
  FolderOpen,
  Search,
  Filter,
  Eye,
  X,
  Building2,
  Package,
  CheckSquare
} from 'lucide-react';
import toast from 'react-hot-toast';

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_URL = rawApiUrl.replace(/\/$/, '');
const API_ENDPOINT_URL = API_URL.endsWith('/api') ? API_URL : `${API_URL}/api`;
const SERVER_URL = API_URL.replace(/\/api$/, '');

const getServerFileUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const fileNamePattern = /^([\w,\s-]+)\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|txt|ppt|pptx)$/i;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (normalizedPath.startsWith('/uploads/')) {
    return `${SERVER_URL}${normalizedPath}`;
  }

  if (normalizedPath.startsWith('/api/uploads/')) {
    return `${SERVER_URL}${normalizedPath.replace(/^\/api/, '')}`;
  }

  if (normalizedPath.startsWith('/upload/')) {
    return `${API_ENDPOINT_URL}${normalizedPath}`;
  }

  if (normalizedPath.startsWith('/api/upload/')) {
    return `${API_URL}${normalizedPath}`;
  }

  if (fileNamePattern.test(path)) {
    return `${SERVER_URL}/uploads/${path}`;
  }

  if (normalizedPath.startsWith('/')) {
    return `${API_ENDPOINT_URL}${normalizedPath}`;
  }

  return `${API_ENDPOINT_URL}/${path}`;
};

const getUploadFilename = (path) => {
  if (!path) return null;
  const segments = path.split(/[/\\]/).filter(Boolean);
  return segments.length ? segments[segments.length - 1] : null;
};

const getFileExtension = (fileOrString) => {
  if (!fileOrString) return '';
  const str = typeof fileOrString === 'string'
    ? fileOrString
    : fileOrString.filename || fileOrString.name || fileOrString.file_url || fileOrString.url || fileOrString.path || fileOrString.file_path || '';
  const cleaned = str.split('?')[0].split('#')[0];
  const segments = cleaned.split('.');
  return segments.length > 1 ? segments[segments.length - 1].toLowerCase() : '';
};

const DataShared = () => {
  const { user } = useAuthStore();
  const [sharedData, setSharedData] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetchData();
    if (user?.role === 'admin') {
      fetchClients();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      let allData = [];

      if (user?.role === 'admin') {
        // Admin sees all shared data from all clients
        const response = await requirementsAPI.getAll({ status: 'all' });
        const requests = response.data.data || [];
        allData = requests.flatMap(req => 
          (req.attachments || []).map(att => normalizeFileObject(att, {
            clientId: req.client_id,
            clientName: req.client_name,
            clientEmail: req.client_email,
            requestId: req.id,
            packageName: req.package_name,
            departmentId: req.department_id,
            requirementStatus: req.status,
            documentsEnabled: req.documents_enabled_for_team_lead || false
          }))
        );
      } else if (user?.role === 'client') {
        // Client sees their own shared data, including requirement attachments and project shared files
        const response = await requirementsAPI.getMyRequirement();
        const req = response.data.data;
        if (req) {
          const attachments = req.attachments || [];
          const projectSharedFiles = req.project_shared_files || [];
          const mergedFiles = [...attachments, ...projectSharedFiles];

          allData = mergedFiles.map(att => normalizeFileObject(att, {
            clientId: user.id,
            clientName: `${user.first_name} ${user.last_name}`,
            clientEmail: user.email,
            requestId: req.id,
            packageName: req.package_name,
            requirementStatus: req.status,
            projectId: req.project_id,
            projectTitle: req.project_title
          }));
        }
      } else if (user?.role === 'team_leader') {
        // Team lead sees shared files from their assigned projects
        try {
          const projectsResponse = await projectsAPI.getAll({ per_page: 1000 });
          const projects = projectsResponse.data.data?.items || 
                          projectsResponse.data.data?.projects || 
                          projectsResponse.data.data || [];
          
          console.log('Team lead projects:', projects);
          
          for (const project of projects) {
            // Check if project has shared_files (files admin selected to share)
            if (project.shared_files && project.shared_files.length > 0) {
              allData.push(...project.shared_files.map(file => normalizeFileObject(file, {
                clientId: project.client_id,
                clientName: project.client_name,
                projectName: project.name,
                projectId: project.id,
                sharedByAdmin: true
              })));
            }
            
            // Also check for requirement attachments if documents are enabled
            if (project.requirement_id) {
              try {
                const reqResponse = await requirementsAPI.getById(project.requirement_id);
                const req = reqResponse?.data?.data;
                if (req && req.attachments && req.documents_enabled_for_team_lead) {
                  // Only add files that weren't already added from shared_files
                  const existingUrls = new Set(allData.map(f => f.url || f.path));
                  const newAttachments = req.attachments.filter(att => 
                    !existingUrls.has(att.url || att.path)
                  );
                  
                  allData.push(...newAttachments.map(att => normalizeFileObject(att, {
                    clientId: req.client_id,
                    clientName: req.client_name,
                    clientEmail: req.client_email,
                    requestId: req.id,
                    packageName: req.package_name,
                    projectName: project.name,
                    projectId: project.id,
                    requirementStatus: req.status
                  })));
                }
              } catch (e) {
                console.log('Error fetching requirement (may need document access):', e.response?.status);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching projects:', error);
        }
      } else if (user?.role === 'team_member') {
        // Team member sees files shared with them via tasks
        const tasksResponse = await tasksAPI.getMyTasks();
        
        const tasks = tasksResponse?.data?.data || [];
        
        for (const task of tasks) {
          if (task.shared_files && task.shared_files.length > 0) {
            allData.push(...task.shared_files.map(file => normalizeFileObject(file, {
              clientId: task.client_id || 'shared',
              clientName: file.client_name || 'Shared via Task',
              taskName: task.title,
              taskId: task.id,
              sharedByAdmin: true,
              sharedVia: 'task'
            })));
          }
        }
      }

      setSharedData(allData);
    } catch (error) {
      toast.error('Failed to load shared data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await clientsAPI.getAll();
      setClients(response.data.data?.clients || []);
    } catch (error) {
      console.error('Failed to load clients');
    }
  };

  const findUrlProperty = (file, path = 'root', depth = 0) => {
    if (!file || depth > 3) return null;

    const isUrlLike = (value) => {
      if (typeof value !== 'string' || value.length === 0) return false;
      return (
        value.startsWith('http') ||
        value.startsWith('https') ||
        value.startsWith('blob:') ||
        value.startsWith('/uploads/') ||
        value.startsWith('/api/uploads/') ||
        value.startsWith('/upload/') ||
        value.startsWith('/api/upload/') ||
        (value.startsWith('/') && !value.includes('.')) ||  // Path but not a filename
        (value.startsWith('./') && !value.includes('.')) ||
        (value.includes('/uploads/') && value.includes('.')) ||
        (value.includes('/download') && value.includes('.'))
      );
    };

    const urlProperties = [
      'file_url',
      'url',
      'path',
      'filePath',
      'src',
      'download_url',
      'fileUrl',
      'downloadUrl',
      'presignedUrl',
      'uploadPath',
      'filepath',
      'file_path',
      'uri',
      'location',
      'file_location'
    ];

    for (const prop of urlProperties) {
      if (file[prop] && typeof file[prop] === 'string' && isUrlLike(file[prop])) {
        return { value: file[prop], source: `${path}.${prop}` };
      }
    }

    if (Array.isArray(file)) {
      for (let index = 0; index < file.length; index += 1) {
        const nestedResult = findUrlProperty(file[index], `${path}[${index}]`, depth + 1);
        if (nestedResult) return nestedResult;
      }
    }

    if (typeof file === 'object') {
      const keys = Object.keys(file);
      for (const key of keys) {
        const value = file[key];

        if (typeof value === 'string' && isUrlLike(value)) {
          return { value, source: `${path}.${key}` };
        }

        if (typeof value === 'object' && value !== null) {
          const nestedResult = findUrlProperty(value, `${path}.${key}`, depth + 1);
          if (nestedResult) return nestedResult;
        }
      }
    }

    return null;
  };

  const getFileUrl = (file) => {
    if (!file) return null;

    const urlResult = findUrlProperty(file) || findUrlProperty(file.file || file.data || file.attributes);
    let rawPath = file.extractedUrl || urlResult?.value;

    if (!rawPath && file.filename && /^[\w,\s-]+\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|txt|ppt|pptx)$/i.test(file.filename)) {
      rawPath = `/uploads/${file.filename}`;
      console.log(`Constructed upload URL from filename: ${rawPath}`);
    }

    if (!rawPath && file.name && /^[\w,\s-]+\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|txt|ppt|pptx)$/i.test(file.name)) {
      rawPath = `/uploads/${file.name}`;
      console.log(`Constructed upload URL from name: ${rawPath}`);
    }

    if (!rawPath && file.file_path) {
      const uploadFileName = getUploadFilename(file.file_path);
      if (uploadFileName) {
        rawPath = `/uploads/${uploadFileName}`;
        console.log(`Constructed upload URL from file_path: ${rawPath}`);
      }
    }

    if (!rawPath && file.path) {
      const uploadFileName = getUploadFilename(file.path);
      if (uploadFileName) {
        rawPath = `/uploads/${uploadFileName}`;
        console.log(`Constructed upload URL from path: ${rawPath}`);
      }
    }

    if (!rawPath && file.id && !file.sharedVia) {
      rawPath = `/upload/files/${file.id}/download`;
      console.log(`Constructed download path from ID: ${rawPath}`);
    }

    if (!rawPath) {
      const fileKeys = Object.keys(file || {});
      const diagnostics = {
        hasId: !!file.id,
        propertyCount: fileKeys.length,
        propertyNames: fileKeys,
        sampleValues: {}
      };
      
      fileKeys.slice(0, 5).forEach(key => {
        const val = file[key];
        diagnostics.sampleValues[key] = typeof val === 'string' ? val.substring(0, 100) : typeof val;
      });

      console.warn('❌ No file URL could be found or constructed. Diagnostics:', diagnostics);
      return null;
    }

    console.log(`✓ Using URL from property "${urlResult?.source || 'extractedUrl'}"`);

    if (rawPath.startsWith('//')) {
      return `${window.location.protocol}${rawPath}`;
    }

    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
      return rawPath;
    }

    if (rawPath.startsWith('blob:')) {
      return rawPath;
    }

    if (rawPath.startsWith('/uploads/')) {
      return `${SERVER_URL}${rawPath}`;
    }

    if (rawPath.startsWith('/api/uploads/')) {
      return `${SERVER_URL}${rawPath.replace(/^\/api/, '')}`;
    }

    if (rawPath.startsWith('/upload/')) {
      return `${API_ENDPOINT_URL}${rawPath}`;
    }

    if (rawPath.startsWith('/api/upload/')) {
      return `${API_URL}${rawPath}`;
    }

    if (rawPath.startsWith('/')) {
      return getServerFileUrl(rawPath);
    }

    return getServerFileUrl(rawPath);
  };

  const normalizeFileObject = (file, additionalProps = {}) => {
    if (!file) return null;

    const nestedFile = file.file || file.data || file.attributes || null;
    const urlCandidate = findUrlProperty(file) || findUrlProperty(nestedFile);

    return {
      id: file.id || file._id || nestedFile?.id,
      name: file.name || file.filename || file.original_name || nestedFile?.name || nestedFile?.filename || 'Unknown File',
      filename: file.filename || file.name || file.original_name || nestedFile?.filename || nestedFile?.name,
      description: file.description || nestedFile?.description,
      file_url: file.file_url || file.fileUrl || file.url || nestedFile?.file_url || nestedFile?.fileUrl || nestedFile?.url,
      url: file.url || file.file_url || file.fileUrl || nestedFile?.url || nestedFile?.file_url || nestedFile?.fileUrl,
      path: file.path || file.filePath || nestedFile?.path || nestedFile?.filePath,
      download_url: file.download_url || file.downloadUrl || nestedFile?.download_url || nestedFile?.downloadUrl,
      uploadedAt: file.uploadedAt || file.uploaded_at || file.created_at || nestedFile?.uploadedAt || nestedFile?.uploaded_at || nestedFile?.created_at || new Date().toISOString(),
      ...additionalProps,
      ...(urlCandidate ? { extractedUrl: urlCandidate.value, extractedUrlSource: urlCandidate.source } : {})
    };
  };

  const getDownloadFileName = (file) => {
    return file.name || file.filename || file.original_name || 'file';
  };

  const handleDownloadFile = async (file) => {
    try {
      if (!file) {
        toast.error('File object is missing');
        console.error('Download error: File is null or undefined');
        return;
      }

      setIsDownloading(true);
      const fileName = getDownloadFileName(file);
      
      // Priority 1: Try to get file URL from the file object
      let fileUrl = getFileUrl(file);

      // Priority 2: Use API download endpoint if no direct file URL is available
      if (!fileUrl && file?.id && !file.sharedVia) {
        fileUrl = `${API_ENDPOINT_URL}/upload/files/${file.id}/download`;
      }

      if (!fileUrl) {
        toast.error('Unable to download file. File URL not found.');
        setIsDownloading(false);
        return;
      }

      // Use fetch to handle the download like receipts
      try {
        const response = await fetch(fileUrl, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Create a blob from the response
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Create a temporary link and click it
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('File downloaded successfully');
      } catch (fetchError) {
        console.warn('Fetch download failed, trying direct link:', fetchError);
        // Fallback to direct link approach
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = fileName;
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('File downloaded successfully');
      }
    } catch (error) {
      toast.error('Failed to download file');
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleViewFile = (file) => {
    try {
      if (!file) {
        toast.error('File object is missing');
        console.error('View file error: File is null or undefined');
        return;
      }

      // Determine the preview URL
      let fileUrl = getFileUrl(file);
      if (!fileUrl && file?.id && !file.sharedVia) {
        fileUrl = `${API_ENDPOINT_URL}/upload/files/${file.id}/download`;
      }

      if (!fileUrl) {
        toast.error('Unable to locate file. Please try again.');
        const availableKeys = Object.keys(file || {});
        console.warn('Unable to construct file URL for file with properties:', availableKeys);
        return;
      }

      // For images, open the fullscreen image viewer
      if (getFilePreviewType(file) === 'image') {
        setSelectedFile({ ...file, previewUrl: fileUrl });
        setShowImageViewer(true);
      } else {
        // For other file types, show the regular file details modal
        setSelectedFile({ ...file, previewUrl: fileUrl });
        setShowPreviewModal(true);
      }
    } catch (error) {
      toast.error('Failed to load file preview');
      console.error('View file error:', error);
    }
  };

  const getFilePreviewType = (file) => {
    const ext = getFileExtension(file);
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (['pdf'].includes(ext)) return 'pdf';
    return 'other';
  };

  const getFileIcon = (file) => {
    const ext = getFileExtension(file);
    if (!ext) return <FileText className="w-8 h-8 text-gray-400" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return <div className="text-xs text-gray-500">IMG</div>;
    } else if (['pdf'].includes(ext)) {
      return <div className="text-xs text-red-500 font-bold">PDF</div>;
    } else if (['doc', 'docx'].includes(ext)) {
      return <div className="text-xs text-blue-500 font-bold">DOC</div>;
    } else if (['xls', 'xlsx'].includes(ext)) {
      return <div className="text-xs text-green-500 font-bold">XLS</div>;
    }
    return <div className="text-xs text-gray-500">{ext.toUpperCase()}</div>;
  };

  const filteredData = sharedData.filter(item => {
    const matchesClient = selectedClient === 'all' || item.clientId === selectedClient;
    const matchesSearch = 
      (item.name || item.filename || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.clientName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesClient && matchesSearch;
  });

  const groupedByClient = filteredData.reduce((acc, item) => {
    if (!acc[item.clientId]) {
      acc[item.clientId] = {
        clientInfo: {
          name: item.clientName,
          email: item.clientEmail,
        },
        files: []
      };
    }
    acc[item.clientId].files.push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Shared</h1>
          <p className="text-gray-600">
            {user?.role === 'admin' 
              ? 'View all files shared by clients across all projects'
              : user?.role === 'client'
              ? 'View all files you have shared'
              : 'View files shared by clients for your projects'
            }
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        {user?.role === 'admin' && (
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="input w-48"
          >
            <option value="all">All Clients</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.first_name} {client.last_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Files</p>
              <p className="text-2xl font-bold">{sharedData.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
              <FolderOpen className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Clients</p>
              <p className="text-2xl font-bold">{Object.keys(groupedByClient).length}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-100 text-green-600">
              <User className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Filtered Files</p>
              <p className="text-2xl font-bold">{filteredData.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-100 text-purple-600">
              <Filter className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="card text-center py-12">
          <Share2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No shared files found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByClient).map(([clientId, data]) => (
            <div key={clientId} className="card">
              {/* Header - Show Project name for all roles */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  {data.files[0]?.projectName ? (
                    <>
                      <h3 className="font-semibold">{data.files[0].projectName}</h3>
                      <p className="text-sm text-gray-500">{data.clientInfo.name}</p>
                    </>
                  ) : user?.role === 'team_member' ? (
                    <>
                      <h3 className="font-semibold">{data.files[0]?.taskName || 'Shared Files'}</h3>
                      <p className="text-sm text-gray-500">{data.files.length} file(s)</p>
                    </>
                  ) : (
                    <>
                      <h3 className="font-semibold">{data.clientInfo.name}</h3>
                      <p className="text-sm text-gray-500">{data.clientInfo.email}</p>
                    </>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  {data.files.length} file(s)
                </span>
              </div>

              {/* Files Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.files.map((file, index) => (
                  <div 
                    key={index} 
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {getFilePreviewType(file) === 'image' && getFileUrl(file) ? (
                          <img
                            src={getFileUrl(file)}
                            alt={file.name || file.filename}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getFileIcon(file)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {file.name || file.filename}
                        </p>
                        {file.description ? (
                          <p className="text-xs text-gray-600 line-clamp-2 mt-1 bg-gray-50 p-1.5 rounded">
                            {file.description}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 italic mt-1">No description</p>
                        )}
                        {user?.role === 'team_leader' && file.projectName && (
                          <p className="text-xs text-primary-600 mt-1">
                            <FolderOpen className="w-3 h-3 inline mr-1" />
                            {file.projectName}
                          </p>
                        )}
                        {user?.role === 'team_member' && file.taskName && (
                          <p className="text-xs text-purple-600 mt-1">
                            <CheckSquare className="w-3 h-3 inline mr-1" />
                            Task: {file.taskName}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          {new Date(file.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      {file.packageName && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Package className="w-3 h-3" />
                          {file.packageName}
                        </div>
                      )}
                      {file.sharedByAdmin && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
                          Shared by Admin
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewFile(file)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(file)}
                        disabled={isDownloading}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm bg-primary-100 text-primary-600 hover:bg-primary-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        {isDownloading ? 'Downloading...' : 'Download'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Large Image Viewer Modal */}
      {showImageViewer && selectedFile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            {/* Close Button */}
            <button
              onClick={() => setShowImageViewer(false)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all z-10"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            {/* Image Container */}
            <div className="flex-1 flex items-center justify-center max-w-6xl w-full">
              <img
                src={selectedFile.previewUrl}
                alt={selectedFile.name || selectedFile.filename}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            </div>

            {/* File Info Footer */}
            <div className="w-full bg-black/50 backdrop-blur text-white p-4 rounded-b-lg mt-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{selectedFile.name || selectedFile.filename}</h3>
                <p className="text-sm text-gray-300 truncate">{selectedFile.description || 'No description'}</p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  type="button"
                  onClick={() => handleDownloadFile(selectedFile)}
                  disabled={isDownloading}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {isDownloading ? 'Downloading...' : 'Download'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Details Modal */}
      {showPreviewModal && selectedFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">File Details</h2>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                  {getFileIcon(selectedFile.name || selectedFile.filename)}
                </div>
                <div>
                  <h3 className="font-semibold">{selectedFile.name || selectedFile.filename}</h3>
                  <p className="text-sm text-gray-500">
                    Shared on {new Date(selectedFile.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {selectedFile.description && (
                <div>
                  <label className="text-sm text-gray-500">Description</label>
                  <p className="mt-1 text-gray-700">{selectedFile.description}</p>
                </div>
              )}

              {selectedFile.packageName && (
                <div>
                  <label className="text-sm text-gray-500">Package</label>
                  <p className="mt-1 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {selectedFile.packageName}
                  </p>
                </div>
              )}

              {selectedFile.clientName && (
                <div>
                  <label className="text-sm text-gray-500">Shared By</label>
                  <p className="mt-1 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {selectedFile.clientName}
                  </p>
                </div>
              )}

              {selectedFile.previewUrl && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  {getFilePreviewType(selectedFile.name || selectedFile.filename) === 'pdf' ? (
                    <iframe
                      src={selectedFile.previewUrl}
                      title={selectedFile.name || selectedFile.filename}
                      className="w-full h-[420px]"
                    />
                  ) : (
                    <div className="p-6 text-sm text-gray-600 bg-gray-50">
                      Preview unavailable for this file type.
                      <br />
                      Use the buttons below to download or open it in a new tab.
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => window.open(selectedFile.previewUrl || getFileUrl(selectedFile), '_blank', 'noopener,noreferrer')}
                  className="flex-1 btn-secondary flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  Open in New Tab
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadFile(selectedFile)}
                  disabled={isDownloading}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {isDownloading ? 'Downloading...' : 'Download'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataShared;
