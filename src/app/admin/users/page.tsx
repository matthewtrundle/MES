import { getUsers, getStationsForUserAssignment, getSitesForUserAssignment } from '@/lib/actions/admin/user-management';
import { UserManagement } from '@/components/admin/UserManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function UsersPage() {
  const [users, stations, sites] = await Promise.all([
    getUsers(),
    getStationsForUserAssignment(),
    getSitesForUserAssignment(),
  ]);

  const activeCount = users.filter((u) => u.active).length;
  const roleBreakdown = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <p className="text-slate-500 mt-1">
          Manage users, roles, and station assignments
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-slate-500">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
            <p className="text-xs text-slate-500">Active Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-slate-400">{users.length - activeCount}</div>
            <p className="text-xs text-slate-500">Inactive Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{Object.keys(roleBreakdown).length}</div>
            <p className="text-xs text-slate-500">Roles in Use</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {users.length} user{users.length !== 1 ? 's' : ''} in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserManagement
            initialUsers={users}
            stations={stations}
            sites={sites}
          />
        </CardContent>
      </Card>
    </div>
  );
}
