export default function CbtDashboard() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-slate-900">
          CBT Dashboard
        </h1>

        <p className="mt-2 text-slate-600">
          Manage computer-based tests, question banks and student examinations.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">
              Question Bank
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Add and manage your examination questions.
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">
              Online CBT
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Create and manage online examinations.
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">
              Offline CBT
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Prepare examinations for computers without Internet access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}