import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ProjectsPage() {
  const { user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);

  const [projectForm, setProjectForm] = useState({
    name: '',
    projectManagerUserId: '',
    cmUserId: ''
  });

  const [packageForm, setPackageForm] = useState({
    projectId: '',
    name: ''
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setMessage('');
      setError('');

      const [projectsResponse, usersResponse] = await Promise.all([
        apiFetch('/projects'),
        apiFetch('/users')
      ]);

      const projectsData = Array.isArray(projectsResponse?.projects)
        ? projectsResponse.projects.map((project) => ({
            ...project,
            id: String(project.id)
          }))
        : [];

      const usersData = Array.isArray(usersResponse?.users)
        ? usersResponse.users
        : [];

      setProjects(projectsData);
      setUsers(usersData);

      setPackageForm((prev) => {
        const currentStillExists =
          prev.projectId &&
          projectsData.some((project) => project.id === String(prev.projectId));

        return {
          ...prev,
          projectId: currentStillExists ? String(prev.projectId) : ''
        };
      });
    } catch (err) {
      setError(err.message || 'Failed to load data');
      setProjects([]);
      setUsers([]);
    }
  }

  async function createProject(event) {
    event.preventDefault();

    try {
      setMessage('');
      setError('');