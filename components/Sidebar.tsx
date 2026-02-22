export default function Sidebar() {
  return (
    <div className="w-64 bg-white shadow-lg flex flex-col p-6">
      <h2 className="text-2xl font-bold text-blue-600 mb-8">
        AI Tutor
      </h2>

      <nav className="space-y-4">
        <div className="hover:bg-blue-50 p-2 rounded cursor-pointer">
          Dashboard
        </div>
        <div className="hover:bg-blue-50 p-2 rounded cursor-pointer">
          My Sessions
        </div>
        <div className="hover:bg-blue-50 p-2 rounded cursor-pointer">
          Progress
        </div>
      </nav>
    </div>
  )
}
