import { auth } from '@/lib/auth'
import { getDB } from '@/lib/db'
import { redirect } from 'next/navigation'
import { signOut } from '@/lib/auth'

export default async function DashboardPage() {
  const session = await auth()
  
  if (!session) {
    redirect('/auth/signin')
  }

  const db = await getDB()
  const userRepo = db.getRepository('users')
  const users = await userRepo.findAll({ limit: 10 })

  return (
    <div className="px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Dashboard
          </h1>
          <form action={async () => {
            'use server'
            await signOut({ redirectTo: '/' })
          }}>
            <button 
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Sign Out
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Welcome, {session.user?.name || session.user?.email}!</h2>
          <p className="text-gray-600 mb-4">
            You're successfully authenticated and can access protected routes.
          </p>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded">
              <h3 className="font-semibold text-blue-900">Session Info</h3>
              <div className="text-blue-800 text-sm mt-2 space-y-1">
                <p><strong>ID:</strong> {session.user?.id}</p>
                <p><strong>Email:</strong> {session.user?.email}</p>
                <p><strong>Name:</strong> {session.user?.name || 'Not provided'}</p>
                <p><strong>Image:</strong> {session.user?.image ? '✅' : '❌'}</p>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded">
              <h3 className="font-semibold text-green-900">Database Status</h3>
              <div className="text-green-800 text-sm mt-2 space-y-1">
                <p><strong>Connection:</strong> ✅ Active</p>
                <p><strong>WAL Mode:</strong> ✅ Enabled</p>
                <p><strong>Users:</strong> {users.length} total</p>
                <p><strong>Type Safety:</strong> ✅ Full</p>
              </div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded">
              <h3 className="font-semibold text-purple-900">NOORMME Features</h3>
              <div className="text-purple-800 text-sm mt-2 space-y-1">
                <p>✅ Auto-discovery</p>
                <p>✅ Repository pattern</p>
                <p>✅ Type generation</p>
                <p>✅ NextAuth integration</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Users</h2>
          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user: any) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.name || 'No name'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No users found in the database.</p>
          )}
        </div>
      </div>
    </div>
  )
}
