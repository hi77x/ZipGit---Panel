import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/states";

export default function NotFound() { return <main className="page"><EmptyState title="Page not found" message="The internal route does not exist or the resource has moved."/><ButtonLink href="/dashboard">Back to dashboard</ButtonLink></main>; }
