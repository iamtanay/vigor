export default function MobileOnlyPage() {
  return (
    <div className="min-h-screen bg-deep-space flex flex-col items-center justify-center p-8 text-center">
      <div className="mb-8">
        <svg width="64" height="64" viewBox="0 0 28 28" fill="none">
          <path
            d="M6 22 L14 6 L22 22"
            stroke="#6C63FF"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 15.5 L18.5 15.5"
            stroke="#39D98A"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <h1 className="text-2xl font-medium text-white mb-3 tracking-[-0.02em]">
        Open Vigor on your phone
      </h1>

      <p className="text-sm text-white/50 max-w-xs leading-relaxed mb-8">
        The Vigor member app is designed for mobile. Scan the QR code below
        or open this link on your phone to get started.
      </p>

      <div className="bg-white rounded-2xl p-4 mb-6">
        <div className="w-32 h-32 bg-[#1A1A2E] rounded-lg flex items-center justify-center">
          <span className="text-vigor-violet text-xs text-center px-2">
            QR Code to joinvigor.co/app
          </span>
        </div>
      </div>

      <a
        href="https://joinvigor.co/app"
        className="text-vigor-violet text-sm underline underline-offset-4"
      >
        joinvigor.co/app
      </a>

      <p className="text-xs text-white/25 mt-8">
        Gym owner?{' '}
        <a
          href="/gym/login"
          className="text-white/40 hover:text-white/60 underline"
        >
          Log in to your dashboard →
        </a>
      </p>
    </div>
  );
}
