import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { Layout } from "@/components/layout";
import Home from "@/pages/home";
import Features from "@/pages/features";
import ForOperators from "@/pages/for-operators";
import Compare from "@/pages/compare";
import Standards from "@/pages/standards";
import Pricing from "@/pages/pricing";
import Hardware from "@/pages/hardware";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import Demo from "@/pages/demo";
import Downloads from "@/pages/downloads";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/features" component={Features} />
      <Route path="/for-operators" component={ForOperators} />
      <Route path="/compare" component={Compare} />
      <Route path="/standards" component={Standards} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/hardware" component={Hardware} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/demo" component={Demo} />
      <Route path="/downloads" component={Downloads} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Layout>
              <Router />
            </Layout>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
