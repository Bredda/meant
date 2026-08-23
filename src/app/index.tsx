import "./global.css";

import AppProvider from "@/app/provider";
import AppRouter from "@/app/router";

export default function App() {
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <AppProvider>
        <AppRouter />
      </AppProvider>
    </div>
  );
}
