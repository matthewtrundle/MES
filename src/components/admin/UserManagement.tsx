'use client';

import { useState, useTransition } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_ROLES, getRoleDisplayName } from '@/lib/auth/rbac';
import type { AppRole } from '@/lib/auth/rbac';
import { deactivateUser, reactivateUser } from '@/lib/actions/admin/user-management';
import { CreateUserDialog } from './CreateUserDialog';
import { EditUserDialog } from './EditUserDialog';
import { toast } from 'sonner';

interface Station {
  id: string;
  name: string;
  stationType: string;
}

interface Site {
  id: string;
  name: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  assignedStationId: string | null;
  assignedStation: { id: string; name: string; stationType?: string } | null;
  sites: { id: string; name: string }[];
  createdAt: Date;
  updatedAt: Date;
}

interface UserManagementProps {
  initialUsers: UserRow[];
  stations: Station[];
  sites: Site[];
}

function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    admin: 'bg-red-100 text-red-800 border-red-200',
    supervisor: 'bg-purple-100 text-purple-800 border-purple-200',
    operator: 'bg-blue-100 text-blue-800 border-blue-200',
    buyer: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    receiving_mgr: 'bg-amber-100 text-amber-800 border-amber-200',
    qa_inspector: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    supply_chain_mgr: 'bg-teal-100 text-teal-800 border-teal-200',
    shipping_coordinator: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  };
  return colors[role] ?? 'bg-slate-100 text-slate-800 border-slate-200';
}

export function UserManagement({ initialUsers, stations, sites }: UserManagementProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Client-side filtering for responsiveness
  const filteredUsers = initialUsers.filter((user) => {
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;
    if (statusFilter === 'active' && !user.active) return false;
    if (statusFilter === 'inactive' && user.active) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!user.name.toLowerCase().includes(q) && !user.email.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  function handleEdit(user: UserRow) {
    setEditingUser(user);
    setEditDialogOpen(true);
  }

  function handleToggleActive(user: UserRow) {
    const action = user.active ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${action} ${user.name}?`)) return;

    startTransition(async () => {
      try {
        if (user.active) {
          await deactivateUser(user.id);
          toast.success(`${user.name} has been deactivated`);
        } else {
          await reactivateUser(user.id);
          toast.success(`${user.name} has been reactivated`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Failed to ${action} user`);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ALL_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {getRoleDisplayName(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <CreateUserDialog stations={stations} sites={sites} />
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span>{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found</span>
        <span className="text-slate-300">|</span>
        <span>{filteredUsers.filter((u) => u.active).length} active</span>
        <span>{filteredUsers.filter((u) => !u.active).length} inactive</span>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Station</TableHead>
            <TableHead>Sites</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                No users found matching your filters.
              </TableCell>
            </TableRow>
          ) : (
            filteredUsers.map((user) => (
              <TableRow key={user.id} className={!user.active ? 'opacity-60' : ''}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-slate-500">{user.email}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={getRoleBadgeColor(user.role)}
                  >
                    {getRoleDisplayName(user.role as AppRole)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.assignedStation ? (
                    <span className="text-sm">
                      {user.assignedStation.name}
                      {user.assignedStation.stationType && (
                        <span className="text-slate-400 ml-1">({user.assignedStation.stationType})</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-sm">--</span>
                  )}
                </TableCell>
                <TableCell>
                  {user.sites.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {user.sites.map((site) => (
                        <Badge key={site.id} variant="secondary" className="text-xs">
                          {site.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 text-sm">--</span>
                  )}
                </TableCell>
                <TableCell>
                  {user.active ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
                      Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(user)}
                      title="Edit user"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(user)}
                      disabled={isPending}
                      title={user.active ? 'Deactivate user' : 'Reactivate user'}
                      className={user.active ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}
                    >
                      {user.active ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Edit Dialog */}
      <EditUserDialog
        user={editingUser}
        stations={stations}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
}
