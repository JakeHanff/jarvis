"use client";

import { useState } from "react";
import { Customizer } from "@/components/shell/Customizer";
import { Dashboard } from "@/components/shell/Dashboard";
import { TopBar } from "@/components/shell/TopBar";

export default function Home() {
  const [customise, setCustomise] = useState(false);
  const [editing, setEditing] = useState(false);
  return (
    <main className="mx-auto max-w-[1680px] px-2 pb-10 pt-2 sm:px-4" style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}>
      <TopBar onCustomise={() => setCustomise(true)} editing={editing} onToggleEdit={() => setEditing((e) => !e)} />
      <Dashboard editing={editing} />
      <Customizer open={customise} onClose={() => setCustomise(false)} />
    </main>
  );
}
