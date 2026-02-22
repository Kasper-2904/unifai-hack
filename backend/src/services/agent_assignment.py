"""
Agent assignment service for selecting and assigning agents to tasks.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.state import AgentStatus, TaskStatus
from src.storage.models import Agent, ProjectAllowedAgent, Task


async def assign_agent_to_task(
    db: AsyncSession,
    task: Task,
    project_id: str | None = None,
) -> dict[str, Any]:
    """
    Select and assign an appropriate agent to a task.

    Selection criteria:
    1. If project_id is provided, only consider agents in the project's allowlist
    2. Agent must be ONLINE
    3. Prefer agents with matching skills for the task type

    Args:
        db: Database session
        task: The task to assign
        project_id: Optional project ID for allowlist filtering

    Returns:
        Dict with 'agent_id' on success, or 'error' on failure
    """
    # Map task types to preferred skills
    task_type_to_skills = {
        "code_generation": ["generate_code", "code"],
        "code_review": ["review_code", "review"],
        "bug_fix": ["debug_code", "debug", "generate_code"],
        "refactor": ["refactor_code", "refactor"],
        "test_generation": ["generate_code", "test"],
        "documentation": ["generate_code", "docs"],
        "security_audit": ["check_security", "security"],
    }

    preferred_skills = task_type_to_skills.get(task.task_type, [])

    # Build query for agents
    if project_id:
        # Get allowed agent IDs for this project
        allowlist_result = await db.execute(
            select(ProjectAllowedAgent.agent_id).where(ProjectAllowedAgent.project_id == project_id)
        )
        allowed_agent_ids = [row[0] for row in allowlist_result.fetchall()]

        if allowed_agent_ids:
            query = select(Agent).where(
                Agent.status == AgentStatus.ONLINE,
                Agent.id.in_(allowed_agent_ids),
            )
        else:
            # No allowlist defined, use all online agents
            query = select(Agent).where(Agent.status == AgentStatus.ONLINE)
    else:
        # No project context, use all online agents
        query = select(Agent).where(Agent.status == AgentStatus.ONLINE)

    result = await db.execute(query)
    agents = list(result.scalars().all())

    if not agents:
        error_msg = "No online agents available"
        if project_id:
            error_msg += " in project allowlist"
        return {"error": error_msg}

    # Try to find an agent with matching skills
    selected_agent = None

    for skill in preferred_skills:
        for agent in agents:
            if skill in (agent.skills or []):
                selected_agent = agent
                break
        if selected_agent:
            break

    # Fall back to first available agent if no skill match
    if not selected_agent:
        selected_agent = agents[0]

    # Assign the agent to the task
    task.assigned_agent_id = selected_agent.id
    task.assigned_at = datetime.utcnow()
    task.status = TaskStatus.ASSIGNED

    await db.commit()
    await db.refresh(task)

    return {
        "agent_id": selected_agent.id,
        "agent_name": selected_agent.name,
        "agent_role": selected_agent.role,
    }


async def get_available_agents_for_project(
    db: AsyncSession,
    project_id: str,
) -> list[Agent]:
    """
    Get all online agents available for a project.

    Args:
        db: Database session
        project_id: Project ID

    Returns:
        List of available agents
    """
    # Get allowed agent IDs
    allowlist_result = await db.execute(
        select(ProjectAllowedAgent.agent_id).where(ProjectAllowedAgent.project_id == project_id)
    )
    allowed_agent_ids = [row[0] for row in allowlist_result.fetchall()]

    if not allowed_agent_ids:
        return []

    result = await db.execute(
        select(Agent).where(
            Agent.status == AgentStatus.ONLINE,
            Agent.id.in_(allowed_agent_ids),
        )
    )
    return list(result.scalars().all())
