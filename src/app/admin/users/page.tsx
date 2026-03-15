import { getUsers, getStationsForUserAssignment, getSitesForUserAssignment } from '@/lib/actions/admin/user-management';
import { UserManagement } from '@/components/admin/UserManagement';

export default async function UsersPage() {
  const [users, stations, sites] = await Promise.all([
    getUsers(),
    getStationsForUserAssignment(),
    getSitesForUserAssignment(),
  ]);

  const activeCount = users.filter((u) => u.active).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">User Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {users.length} user{users.length !== 1 ? 's' : ''} &middot; {activeCount} active
        </p>
      </div>

      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
        <UserManagement
          initialUsers={users}
          stations={stations}
          sites={sites}
        />
      </div>
    </div>
  );
}
