import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Terms of Service — ProgFans",
  description: "The terms for using ProgFans.",
};

const CONTACT = "support@progfans.com";
const UPDATED = "19 June 2026";

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-8 mb-2 font-display text-xl font-bold text-ink">{children}</h2>
);
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-3 leading-relaxed text-ink/90">{children}</p>
);

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <SiteHeader />
      <h1 className="font-display text-3xl font-extrabold text-ink">Terms of Service</h1>
      <p className="mt-1 text-sm text-muted">Last updated: {UPDATED}</p>

      <P>
        These Terms govern your use of ProgFans (“ProgFans”, “we”, “us”) at{" "}
        <span className="font-medium">progfans.com</span>. By using the site or creating an account,
        you agree to these Terms. If you don’t agree, please don’t use ProgFans.
      </P>

      <H2>The service</H2>
      <P>
        ProgFans is a catalog and tracking site for progression fantasy and litRPG. It lets you
        discover series, track what you’re reading, rate titles, build tier lists, and suggest
        edits. Catalog information is aggregated from public sources (such as Royal Road and
        Goodreads) and community contributions, and is provided for informational purposes.
      </P>

      <H2>Your account</H2>
      <ul className="mb-3 list-disc space-y-1 pl-5 text-ink/90">
        <li>You must provide accurate information and keep your login credentials secure.</li>
        <li>You’re responsible for activity that happens under your account.</li>
        <li>
          You must be at least 16 years old, or the age of digital consent in your country, to
          create an account.
        </li>
        <li>One person per account; don’t impersonate others or use a misleading username.</li>
      </ul>

      <H2>Your content</H2>
      <P>
        You keep ownership of the content you create on ProgFans — your tier lists, scores, reviews,
        suggested edits, and profile. By posting it, you grant us a non-exclusive, worldwide,
        royalty-free licence to host and display that content as part of operating the site.
      </P>
      <P>
        You’re responsible for your content, and you agree not to post anything unlawful,
        infringing, hateful, harassing, or spam. We may edit, remove, or refuse content, and may
        suspend or terminate accounts that break these Terms.
      </P>

      <H2>Acceptable use</H2>
      <P>
        Don’t misuse the service: no scraping or automated bulk access, no attempts to disrupt or
        breach the site’s security, no spamming or manipulating ratings, and nothing that violates
        applicable law or the rights of others.
      </P>

      <H2>Catalog and third-party content</H2>
      <P>
        Book titles, descriptions, cover images, ratings, and external links refer to works and
        services owned by their respective authors, publishers, and platforms (such as Royal Road,
        Goodreads, Amazon, and Audible). ProgFans does not host the books themselves and is not
        affiliated with or endorsed by those platforms. Ratings shown on ProgFans are aggregated or
        derived and are provided “as is”. Some outbound links may be affiliate links.
      </P>

      <H2>Intellectual property</H2>
      <P>
        The ProgFans name, design, software, and original content are owned by us and protected by
        applicable laws. You may not copy, resell, or create derivative services from them without
        our permission.
      </P>

      <H2>Disclaimers</H2>
      <P>
        ProgFans is provided “as is” and “as available”, without warranties of any kind. We don’t
        guarantee that the site will be uninterrupted, error-free, or that catalog data is accurate,
        complete, or up to date.
      </P>

      <H2>Limitation of liability</H2>
      <P>
        To the maximum extent permitted by law, ProgFans and its operators will not be liable for
        any indirect, incidental, or consequential damages, or for any loss of data or profits,
        arising from your use of the service.
      </P>

      <H2>Termination</H2>
      <P>
        You can stop using ProgFans and delete your account at any time. We may suspend or terminate
        access if you breach these Terms or to protect the service and its users.
      </P>

      <H2>Changes to these Terms</H2>
      <P>
        We may update these Terms from time to time. When we do, we’ll revise the “Last updated”
        date above, and continued use of ProgFans means you accept the updated Terms.
      </P>

      <H2>Governing law</H2>
      <P>
        These Terms are governed by the laws of the Netherlands, without regard to conflict-of-law
        rules.
      </P>

      <H2>Contact</H2>
      <P>
        Questions about these Terms? Email{" "}
        <a href={`mailto:${CONTACT}`} className="text-gold hover:underline">
          {CONTACT}
        </a>
        . See also our{" "}
        <Link href="/privacy" className="text-gold hover:underline">
          Privacy Policy
        </Link>
        .
      </P>
    </div>
  );
}
