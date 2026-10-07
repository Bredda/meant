import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  ErrorActions,
  ErrorDescription,
  ErrorHeader,
  ErrorView,
} from "@/features/errors/error-base";

export default function NotFoundErrorPage() {
  const navigate = useNavigate();
  return (
    <ErrorView>
      <ErrorHeader>Page not found</ErrorHeader>
      <ErrorDescription>
        Sorry, we couldn’t find the page you’re looking for.
      </ErrorDescription>
      <ErrorActions>
        <Button onClick={() => navigate(-1)} size="lg">
          Go back
        </Button>
      </ErrorActions>
    </ErrorView>
  );
}

// Necessary for react router to lazy load.
export const Component = NotFoundErrorPage;
