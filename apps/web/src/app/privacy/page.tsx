import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Privacy Policy — ProgFans",
  description: "How ProgFans collects, uses, and protects your information.",
};

const CONTACT = "privacy@progfans.com";
const UPDATED = "19 June 2026";

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-8 mb-2 font-display text-xl font-bold text-ink">{children}</h2>
);
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-3 leading-relaxed text-ink/90">{children}</p>
);

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <SiteHeader />
      <h1 className="font-display text-3xl font-extrabold text-ink">Privacy Policy</h1>
      <p className="mt-1 text-sm text-muted">Last updated: {UPDATED}</p>

      <P>
        ProgFans (“ProgFans”, “we”, “us”) is a website for discovering and tracking progression
        fantasy and litRPG. This policy explains what information we collect, how we use it, and the
        choices you have. By using <span className="font-medium">progfans.com</span> you agree to
        this policy.
      </P>

      <H2>Information we collect</H2>
      <P>We collect only what we need to run the service:</P>
      <ul className="mb-3 list-disc space-y-1 pl-5 text-ink/90">
        <li>
          <span className="font-medium">Account information.</span> Your email address and the
          username you choose. If you sign in with Google, we receive your email address and basic
          profile (name and avatar) from Google. Passwords for email sign-ups are handled by our
          authentication provider; we never see or store them in plain text.
        </li>
        <li>
          <span className="font-medium">Profile information (optional).</span> A display name, bio,
          location, birthday, gender, and avatar image, if you choose to add them.
        </li>
        <li>
          <span className="font-medium">Activity.</span> The series you track and their statuses,
          scores you give, favourites, tier lists you create, upvotes, and any edits you suggest to
          the catalog.
        </li>
        <li>
          <span className="font-medium">Technical data.</span> Cookies needed to keep you signed in
          and remember your theme preference, plus standard server logs (such as IP address and
          browser type) kept by our hosting provider for security and reliability.
        </li>
      </ul>
      <P>
        We do <span className="font-medium">not</span> collect payment information — there is
        nothing to buy on ProgFans — and we do not use advertising or cross-site tracking cookies.
      </P>

      <H2>How we use your information</H2>
      <ul className="mb-3 list-disc space-y-1 pl-5 text-ink/90">
        <li>To provide the service: your account, profile, lists, and tier lists.</li>
        <li>To authenticate you and keep your account secure.</li>
        <li>
          To send you transactional emails you’d expect, such as confirming your email address or
          resetting your password. We don’t send marketing email.
        </li>
        <li>To operate, maintain, debug, and improve the site.</li>
      </ul>

      <H2>How your information is shared</H2>
      <P>
        We do not sell your personal information. We share it only with the service providers that
        help us run ProgFans, and only so they can provide their service to us:
      </P>
      <ul className="mb-3 list-disc space-y-1 pl-5 text-ink/90">
        <li>
          <span className="font-medium">Supabase</span> — database and authentication.
        </li>
        <li>
          <span className="font-medium">Vercel</span> — website hosting.
        </li>
        <li>
          <span className="font-medium">Resend</span> — sending transactional email.
        </li>
        <li>
          <span className="font-medium">Google</span> — only if you choose to sign in with Google.
        </li>
      </ul>
      <P>
        We may also disclose information if required by law, or to protect the rights, safety, and
        security of ProgFans and its users.
      </P>

      <H2>Affiliate links</H2>
      <P>
        Some “where to read” links (for example, to Amazon or Audible) may be affiliate links, and
        we may earn a small commission if you make a purchase. This is at no extra cost to you and
        does not influence ratings, rankings, or which titles we show.
      </P>

      <H2>Cookies</H2>
      <P>
        We use only essential cookies: one to keep you signed in (set by our authentication
        provider) and one to remember whether you prefer light or dark mode. We do not use cookies
        for advertising or to track you across other websites.
      </P>

      <H2>Data retention</H2>
      <P>
        We keep your account information for as long as your account is active. You can ask us to
        delete your account and personal data at any time by contacting us, and we will remove it
        except where we are required to keep certain records by law. Public contributions (such as a
        tier list) may be anonymised rather than removed.
      </P>

      <H2>Your rights</H2>
      <P>
        Depending on where you live (for example, in the EEA or UK), you have the right to access,
        correct, delete, export, or object to our processing of your personal data. You can edit
        much of your profile directly in your account settings, and you can exercise any other right
        by contacting us at <span className="font-medium">{CONTACT}</span>.
      </P>

      <H2>International transfers</H2>
      <P>
        ProgFans is operated from the European Union, and our providers may process data in the EU
        and the United States. Where data is transferred internationally, we rely on our providers’
        appropriate safeguards for such transfers.
      </P>

      <H2>Security</H2>
      <P>
        We take reasonable technical and organisational measures to protect your information.
        However, no method of transmission or storage is completely secure, and we cannot guarantee
        absolute security.
      </P>

      <H2>Children</H2>
      <P>
        ProgFans is not directed to children under 16, and we do not knowingly collect personal
        information from them. If you believe a child has provided us information, please contact us
        and we will delete it.
      </P>

      <H2>Changes to this policy</H2>
      <P>
        We may update this policy from time to time. When we do, we’ll revise the “Last updated”
        date above, and significant changes will be made clear on the site.
      </P>

      <H2>Contact</H2>
      <P>
        Questions about this policy or your data? Email us at{" "}
        <a href={`mailto:${CONTACT}`} className="text-gold hover:underline">
          {CONTACT}
        </a>
        .
      </P>
    </div>
  );
}
