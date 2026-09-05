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
    <div className="flex flex-col sm:flex-row gap-4 justify-between mt-12 pt-8 border-t border-zinc-200/80">
      {prev ? (
        <Link 
          href={prev.href}
          className="group flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 hover:border-(--brand) hover:shadow-sm transition-all sm:w-1/2 no-underline"
        >
          <span className="flex items-center text-xs font-medium text-zinc-500 uppercase tracking-wider group-hover:text-(--brand)">
            <ArrowLeft className="mr-2 w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Previous
          </span>
          <span className="text-base font-semibold text-zinc-900 group-hover:text-(--brand)">{prev.title}</span>
        </Link>
      ) : (
        <div className="sm:w-1/2" />
      )}

      {next ? (
        <Link 
          href={next.href}
          className="group flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 hover:border-(--brand) hover:shadow-sm transition-all sm:w-1/2 items-end text-right no-underline"
        >
          <span className="flex items-center text-xs font-medium text-zinc-500 uppercase tracking-wider group-hover:text-(--brand)">
            Next
            <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
          </span>
          <span className="text-base font-semibold text-zinc-900 group-hover:text-(--brand)">{next.title}</span>
        </Link>
      ) : (
        <div className="sm:w-1/2" />
      )}
    </div>
  );
}
