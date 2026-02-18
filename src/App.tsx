import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { StudentAuthProvider } from "@/lib/studentAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Presenca from "./pages/Presenca";
import NotFound from "./pages/NotFound";
import AlunoLogin from "./pages/aluno/Login";
import AlunoDashboard from "./pages/aluno/Dashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <StudentAuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/presenca" element={<Presenca />} />
              <Route path="/dashboard/*" element={<Dashboard />} />
              {/* Rotas do Portal do Aluno */}
              <Route path="/aluno/login" element={<AlunoLogin />} />
              <Route path="/aluno/dashboard" element={<AlunoDashboard />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </StudentAuthProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
