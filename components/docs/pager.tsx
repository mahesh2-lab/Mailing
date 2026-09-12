import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface PagerLink {
  title: string;
  href: string;
}

interface DocsPagerProps {
  prev?: PagerLink;
  next?: PagerLink;
}

export function DocsPager({ prev, next }: DocsPagerProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-between mt-12 pt-8 border-t border-border">
      {prev ? (
        <Link 
          href={prev.href}
          className="group flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 hover:bg-accent/40 hover:border-primary/40 transition-all sm:w-1/2 no-underline"
        >
          <span className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground">
            <ArrowLeft className="mr-1.5 size-3.5 transition-transform group-hover:-translate-x-1" />
            Previous
          </span>
          <span className="text-sm font-semibold text-foreground">{prev.title}</span>
        </Link>
      ) : (
        <div className="sm:w-1/2" />
      )}

      {next ? (
        <Link 
          href={next.href}
          className="group flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 hover:bg-accent/40 hover:border-primary/40 transition-all sm:w-1/2 items-end text-right no-underline"
        >
          <span className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground">
            Next
            <ArrowRight className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-1" />
          </span>
          <span className="text-sm font-semibold text-foreground">{next.title}</span>
        </Link>
      ) : (
        <div className="sm:w-1/2" />
      )}
    </div>
  );
}
