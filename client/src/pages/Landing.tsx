import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
              <i className="fas fa-chart-line text-white text-2xl"></i>
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-secondary mb-2">CB Workflow</h1>
          <p className="text-gray-600 mb-6">CRO Agency Management Platform</p>
          <p className="text-gray-500 text-sm mb-8">
            Streamline your colorblock creation process for Facebook ads testing
          </p>
          
          <Button 
            onClick={() => window.location.href = '/api/login'} 
            className="w-full bg-primary hover:bg-primary-dark text-white"
            data-testid="button-login"
          >
            Sign In to Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
