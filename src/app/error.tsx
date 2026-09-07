"use client";
import { ErrorState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main className="page"><ErrorState title="This view could not be rendered" message="The failure was contained and no GitHub mutation will be retried automatically."/><Button onClick={reset}>Retry this view</Button></main>; }
