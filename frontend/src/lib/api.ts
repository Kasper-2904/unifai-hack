// =============================================================
// Real API service — actual fetch calls to the backend.
// Replaces mock API with real backend endpoints at /api/v1
// =============================================================

import { apiClient } from '@/lib/apiClient'
import type {
  Agent,
  DeveloperDashboard,
  MarketplaceAgent,
  Plan,
  Project,
  RiskSignal,
  SubtaskDetail,
  Task,
  Team,
  TeamMember,
} from '@/lib/types'

// ---- Tasks ----

export async function getTasks(): Promise<Task[]> {
  const { data } = await apiClient.get<Task[]>('/tasks')
  return data
}

export async function getTask(id: string): Promise<Task | null> {
  try {
    const { data } = await apiClient.get<Task>(`/tasks/${id}`)
    return data
  } catch {
    return null
  }
}

// ---- Subtasks ----

export async function getSubtasks(taskId: string): Promise<SubtaskDetail[]> {
  const { data } = await apiClient.get<SubtaskDetail[]>('/subtasks', {
    params: { task_id: taskId },
  })
  return data
}

// ---- Projects ----

export async function getProjects(): Promise<Project[]> {
  const { data } = await apiClient.get<Project[]>('/projects')
  return data
}

export async function getProject(id: string): Promise<Project | undefined> {
  try {
    const { data } = await apiClient.get<Project>(`/projects/${id}`)
    return data
  } catch {
    return undefined
  }
}

// ---- Team Members ----

export async function getTeamMembers(projectId: string): Promise<TeamMember[]> {
  const { data } = await apiClient.get<TeamMember[]>(`/team-members/project/${projectId}`)
  return data
}

// ---- Plans ----

export async function getPlans(taskId?: string): Promise<Plan[]> {
  const params = taskId ? { task_id: taskId } : {}
  const { data } = await apiClient.get<Plan[]>('/plans', { params })
  return data
}

// ---- Risk Signals ----

export async function getRiskSignals(taskId?: string): Promise<RiskSignal[]> {
  const params = taskId ? { task_id: taskId } : {}
  const { data } = await apiClient.get<RiskSignal[]>('/risks', { params })
  return data
}

// ---- Agents ----

export async function getAgents(): Promise<Agent[]> {
  const { data } = await apiClient.get<Agent[]>('/agents')
  return data
}

export async function getAgent(id: string): Promise<Agent | undefined> {
  try {
    const { data } = await apiClient.get<Agent>(`/agents/${id}`)
    return data
  } catch {
    return undefined
  }
}

// ---- Marketplace ----

export async function getMarketplaceCatalog(category?: string): Promise<MarketplaceAgent[]> {
  const params = category ? { category } : {}
  const { data } = await apiClient.get<MarketplaceAgent[]>('/marketplace/catalog', { params })
  return data
}

export async function getMarketplaceAgent(id: string): Promise<MarketplaceAgent | null> {
  try {
    const { data } = await apiClient.get<MarketplaceAgent>(`/marketplace/catalog/${id}`)
    return data
  } catch {
    return null
  }
}

export async function publishAgent(agentData: {
  name: string
  category: string
  description: string
  pricing_type: string
  price_per_use: number | null
  inference_provider: string
  inference_endpoint: string
  inference_model: string
}): Promise<MarketplaceAgent> {
  const { data } = await apiClient.post<MarketplaceAgent>('/marketplace/publish', agentData)
  return data
}

// ---- Reviewer Findings ----

export async function getReviewerFindings(projectId: string): Promise<RiskSignal[]> {
  const { data } = await apiClient.get<RiskSignal[]>('/risks', {
    params: { project_id: projectId, source: 'reviewer' },
  })
  return data
}

// ---- Teams ----

export async function getTeams(): Promise<Team[]> {
  const { data } = await apiClient.get<Team[]>('/teams')
  return data
}

export async function getTeam(teamId: string): Promise<Team | undefined> {
  try {
    const { data } = await apiClient.get<Team>(`/teams/${teamId}`)
    return data
  } catch {
    return undefined
  }
}

export async function getTeamProjects(teamId: string): Promise<Project[]> {
  const { data } = await apiClient.get<Project[]>(`/teams/${teamId}/projects`)
  return data
}

// ---- Project Tasks ----

export async function getProjectTasks(projectId: string): Promise<Task[]> {
  const { data } = await apiClient.get<Task[]>(`/projects/${projectId}/tasks`)
  return data
}

// ---- Dashboard ----

export async function getDeveloperDashboard(userId: string): Promise<DeveloperDashboard> {
  const { data } = await apiClient.get<DeveloperDashboard>(`/dashboard/developer/${userId}`)
  return data
}
