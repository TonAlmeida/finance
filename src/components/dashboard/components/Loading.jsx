// components/Loading.jsx
export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-900 to-blue-900 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p>Carregando dados financeiros...</p>
      </div>
    </div>
  );
}