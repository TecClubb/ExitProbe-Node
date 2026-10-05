import type { ExitProbe } from '../client';
import type { ApiResponse, ListMonitorsParams, MonitorList, Project, ProjectInput } from '../types';

export class ProjectsResource {
  constructor(private readonly client: ExitProbe) {}

  /** GET /projects */
  list(): Promise<ApiResponse<{ projects: Project[] }>> {
    return this.client.request('GET', '/projects');
  }

  /** POST /projects */
  create(input: ProjectInput): Promise<ApiResponse<{ project: Project }>> {
    return this.client.request('POST', '/projects', { body: input });
  }

  /** GET /projects/{id} */
  get(id: number): Promise<ApiResponse<{ project: Project }>> {
    return this.client.request('GET', `/projects/${id}`);
  }

  /** PUT /projects/{id} */
  update(id: number, input: Partial<ProjectInput>): Promise<ApiResponse<{ project: Project }>> {
    return this.client.request('PUT', `/projects/${id}`, { body: input });
  }

  /** DELETE /projects/{id} — soft-deletes; see `restore`. */
  delete(id: number): Promise<ApiResponse<unknown>> {
    return this.client.request('DELETE', `/projects/${id}`);
  }

  /** POST /projects/{id}/restore */
  restore(id: number): Promise<ApiResponse<{ project: Project }>> {
    return this.client.request('POST', `/projects/${id}/restore`);
  }

  /** POST /projects/{id}/regenerate-key — rotates the project's `api_key`. */
  regenerateKey(id: number): Promise<ApiResponse<{ project: Project }>> {
    return this.client.request('POST', `/projects/${id}/regenerate-key`);
  }

  /** DELETE /projects/{id}/checks — clears stored check history for every monitor in the project. */
  clearChecks(id: number): Promise<ApiResponse<unknown>> {
    return this.client.request('DELETE', `/projects/${id}/checks`);
  }

  /** GET /projects/{id}/monitors — monitors scoped to this project (same params as `monitors.list`). */
  monitors(id: number, params: ListMonitorsParams = {}): Promise<ApiResponse<MonitorList>> {
    return this.client.request('GET', `/projects/${id}/monitors`, { query: params });
  }
}
