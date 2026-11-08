import { columns, normalizeTask, type Status, type Task } from './board-model'
const titles: Record<Status, string[]> = {
  todo: ['Review performance metrics', 'Respond to beta test questions', 'Plan upcoming sprint goals', 'Update onboarding documentation and guides', 'Customer stories', 'Refresh product color palette', 'Review latest marketing approach and sprints', 'Code review for authentication service updates', 'Prepare customer research', 'Refine product roadmap', 'Update help center', 'Explore new integrations'],
  in_progress: ['Sales demo sync', 'Launch demo video', 'Headcount planning', 'Engineering sync', 'IT inventory audit'],
  in_review: ['Marketing campaign designs', 'Latest features customer emails'],
  done: ['Weekly sales status report', 'Project onboarding', 'Finalize launch timeline', 'All hands alignment', 'Draft press release', 'Report daily performance summaries', 'Product launch weekly report', 'Project kickoff'],
}
export const sampleTasks: Task[] = columns.flatMap(c => titles[c.status].map((title, i) => (normalizeTask({ id: `sample-${c.status}-${i}`, title, status: c.status }))))
