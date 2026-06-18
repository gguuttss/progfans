"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { voteTierList } from "@/app/actions/tier";

export function VoteButton({
  id,
  initialVotes,
  initialVoted,
  signedIn,
}: {
  id: number;
  initialVotes: number;
  initialVoted: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [votes, setVotes] = useState(initialVotes);
  const [voted, setVoted] = useState(initialVoted);
  const [pending, start] = useTransition();

  const onClick = (e: React.MouseEvent) => {
    // Cards are click-through links; don't navigate when voting.
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      router.push("/login");
      return;
    }
    const prevVoted = voted;
    const prevVotes = votes;
    setVoted(!prevVoted);
    setVotes(prevVotes + (prevVoted ? -1 : 1));
    start(async () => {
      const res = await voteTierList(id);
      if (res.ok) {
        setVoted(res.voted);
        setVotes(res.votes);
      } else {
        setVoted(prevVoted);
        setVotes(prevVotes);
        if (res.needsAuth) router.push("/login");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={voted}
      aria-label={voted ? "Remove upvote" : "Upvote"}
      title={signedIn ? (voted ? "Remove upvote" : "Upvote") : "Sign in to upvote"}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-semibold transition-colors ${
        voted
          ? "border-gold bg-gold/10 text-gold"
          : "border-line text-muted hover:border-gold hover:text-ink"
      }`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m18 15-6-6-6 6" />
      </svg>
      <span className="tnum">{votes}</span>
    </button>
  );
}
