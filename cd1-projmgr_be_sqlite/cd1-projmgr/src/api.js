//src/api.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://10.73.132.145:5005/api", // trùng với Flask
});

// GET /api/projects  → trả về [{ id, name, owner, codeSale, level, phases: [...] }]
export const getProjects = async () => {
  const res = await api.get("/projects");
  return res.data;
};

// POST /api/projects
export const createProject = async (project) => {
  const res = await api.post("/projects", project);
  return res.data;
};

// PUT /api/projects/:id
export const updateProject = async (id, project) => {
  const res = await api.put(`/projects/${id}`, project);
  return res.data;
};

// DELETE /api/projects/:id
export const deleteProjectApi = async (id) => {
  const res = await api.delete(`/projects/${id}`);
  return res.data;
};

// Export dữ liệu (trả về file JSON)
export const exportProjectsApi = async () => {
  const res = await api.get("/projects/export", {
    responseType: "blob",
  });
  return res.data;
};
