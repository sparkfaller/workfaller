export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  department?: string
  position?: string
  organization_id?: string
  is_admin?: boolean
  team_id?: string
  created_at: string
}

export interface Team {
  id: string
  name: string
  organization_id: string
  created_at: string
}

export interface Department {
  id: string
  name: string
  description?: string
  created_at: string
}

export interface Post {
  id: string
  title: string
  content: string
  author_id: string
  category: 'notice' | 'announcement' | 'discussion'
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  post_id: string
  author_id: string
  content: string
  created_at: string
}

export interface Task {
  id: string
  title: string
  description?: string
  assignee_id?: string
  assignee_team_id?: string
  creator_id: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  due_date?: string
  created_at: string
  updated_at: string
}

export interface Calendar {
  id: string
  title: string
  description?: string
  start_date: string
  end_date: string
  creator_id: string
  participants: string[]
  type: 'meeting' | 'event' | 'deadline'
  created_at: string
}

export interface DriveFile {
  id: string
  name: string
  size?: number
  type: string
  path?: string
  parent_id?: string | null
  is_folder: boolean
  owner_id: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
}

export interface Approval {
  id: string
  title: string
  content: string
  drafter_id: string
  status: 'pending' | 'approved' | 'rejected'
  current_approver_id?: string
  created_at: string
  updated_at: string
}

export interface ApprovalLine {
  id: string
  approval_id: string
  approver_id: string
  step: number
  status: 'pending' | 'approved' | 'rejected'
  comment?: string
  updated_at?: string
}

export interface Organization {
  id: string
  name: string
  owner_id: string
  invite_code?: string
  created_at: string
}

export interface Invitation {
  id: string
  email: string
  organization_id: string
  token: string
  status: 'pending' | 'accepted' | 'expired'
  created_at: string
}
