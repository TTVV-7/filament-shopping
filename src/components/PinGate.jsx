import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";

const SESSION_KEY = "filament.admin.unlocked";
const CORRECT_PIN = import.meta.env.VITE_ADMIN_PIN || "1234";

export function usePinGate() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");

  function unlock() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setUnlocked(true);
  }

  function lock() {
    sessionStorage.removeItem(SESSION_KEY);
    setUnlocked(false);
  }

  return { unlocked, unlock, lock, CORRECT_PIN };
}

export function PinGate({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      onUnlock();
    } else {
      setError(true);
      setPin("");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-100 flex items-center justify-center">
      <div className="backdrop-blur-sm bg-white/80 border border-white/60 rounded-2xl shadow-sm p-8 w-full max-w-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
            <Lock size={22} className="text-teal-700" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-slate-800">Admin access</h2>
            <p className="text-sm text-slate-400 mt-1">Enter your PIN to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-3">
            <Input
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(false); }}
              className={`text-center text-lg tracking-widest ${error ? "border-red-400 focus-visible:ring-red-400" : ""}`}
              autoFocus
            />
            {error && <p className="text-xs text-red-500 text-center">Incorrect PIN</p>}
            <Button type="submit" className="w-full" disabled={!pin}>
              Unlock
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
