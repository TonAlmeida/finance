export default function ErrorMessage({ mensagem, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg mb-6 max-w-md w-full">
        <strong className="block text-lg mb-2">Erro:</strong> 
        <p>{mensagem}</p>
      </div>
      <button
        onClick={onRetry}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
      >
        Tentar Novamente
      </button>
    </div>
  );
}