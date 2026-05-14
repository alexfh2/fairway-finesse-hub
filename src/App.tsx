import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import '@/i18n';
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/admin/ProtectedRoute";
import AdminLayout from "./components/admin/AdminLayout";
import Index from "./pages/Index";
import Rankings from "./pages/Rankings";
import Rounds from "./pages/Rounds";
import Players from "./pages/Players";
import PlayerDetail from "./pages/PlayerDetail";

import Stats from "./pages/Stats";
import News from "./pages/News";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSeasons from "./pages/admin/AdminSeasons";
import AdminRounds from "./pages/admin/AdminRounds";
import AdminManageAdmins from "./pages/admin/AdminManageAdmins";
import AdminPlayers from "./pages/admin/AdminPlayers";
import AdminNews from "./pages/admin/AdminNews";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/ranquings" element={<Rankings />} />
              <Route path="/jornades" element={<Rounds />} />
              <Route path="/jugadors" element={<Players />} />
              <Route path="/jugadors/:id" element={<PlayerDetail />} />
              
              <Route path="/estadistiques" element={<Stats />} />
              <Route path="/noticies" element={<News />} />
            </Route>

            {/* Admin routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="temporades" element={<AdminSeasons />} />
              <Route path="jornades" element={<AdminRounds />} />
              <Route path="jugadors" element={<AdminPlayers />} />
              <Route path="noticies" element={<AdminNews />} />
              <Route path="admins" element={<AdminManageAdmins />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
