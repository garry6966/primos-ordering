import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import { Component, type ErrorInfo, type ReactNode } from "react";
import Home from "./pages/Home";
import Menu from "./pages/Menu";
import Checkout from "./pages/Checkout";
import Confirmation from "./pages/Confirmation";
import Kitchen from "./pages/Kitchen";
import Reviews from "./pages/Reviews";
import Loyalty from "./pages/Loyalty";
import Account from "./pages/Account";

// Error Boundary to prevent blank pages
class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-lg text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-600 text-sm mb-4">
              The page encountered an error. This usually fixes itself with a refresh.
            </p>
            <div className="text-left bg-gray-100 rounded-lg p-3 mb-4 max-h-60 overflow-auto">
              <p className="text-xs font-mono text-red-600 mb-2 break-all">
                {this.state.error?.message || "Unknown error"}
              </p>
              <p className="text-xs font-mono text-gray-500 break-all whitespace-pre-wrap">
                {this.state.errorInfo?.componentStack || this.state.error?.stack || "No stack trace"}
              </p>
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              className="bg-[#E31837] hover:bg-[#c01530] text-white font-bold py-3 px-6 rounded-lg"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">404</h1>
        <p className="text-gray-600 mt-2">Page not found</p>
        <a href="/" className="text-red-600 mt-4 inline-block hover:underline">Go home</a>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/menu" component={Menu} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/confirmation/:orderNumber" component={Confirmation} />
      <Route path="/kitchen" component={Kitchen} />
      <Route path="/reviews" component={Reviews} />
      <Route path="/loyalty" component={Loyalty} />
      <Route path="/account" component={Account} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </CartProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
