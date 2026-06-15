import { useMutation, useQueryClient } from 'react-query';
import { projectsAPI } from '../services/api';

export const useUpdateProjectStatus = () => {
  const queryClient = useQueryClient();

  return useMutation(
    ({ projectId, status }) => projectsAPI.updateStatus(projectId, status),
    {
      onSuccess: (data, { projectId }) => {
        // Invalidate the project queries to refetch
        queryClient.invalidateQueries('projects');
        queryClient.invalidateQueries(['project', projectId]);
      },
      onError: (error) => {
        console.error('Failed to update project status:', error);
      },
    }
  );
};
