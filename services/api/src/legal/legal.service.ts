import { Injectable } from '@nestjs/common';
import { RIOT_LEGAL_BOILERPLATE } from '../auth/auth.service.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const SHARED_STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 0; background: #0f1116; color: #e5e5e5; display: flex; flex-direction: column; min-height: 100vh; }
  header { background: #12151c; border-bottom: 1px solid #2e3140; padding: 1rem 2rem; }
  header a { color: #ff4655; text-decoration: none; font-weight: 700; font-size: 1.1rem; }
  main { flex: 1; max-width: 800px; margin: 0 auto; padding: 2.5rem 2rem; width: 100%; }
  h1 { color: #ff4655; margin-bottom: 0.25rem; }
  .updated { color: #6b7280; font-size: 0.85rem; margin-bottom: 2rem; }
  h2 { color: #e5e5e5; margin-top: 2rem; border-bottom: 1px solid #2e3140; padding-bottom: 0.5rem; }
  p, li { color: #9ca3af; line-height: 1.7; }
  a { color: #ff4655; }
  footer { background: #12151c; border-top: 1px solid #2e3140; padding: 1.25rem 2rem; text-align: center; font-size: 0.75rem; color: #6b7280; line-height: 1.6; }
`;

const RIOT_LEGAL_FOOTER_HTML = `<footer>
  ${escapeHtml(RIOT_LEGAL_BOILERPLATE)}
</footer>`;

@Injectable()
export class LegalService {
  getTermsOfServiceHtml(): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Terms of Service &mdash; Valorant Tournament Hosting Framework</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <header>
    <a href="/auth/register">&larr; Back to Registration</a>
  </header>
  <main>
    <h1>Terms of Service</h1>
    <p class="updated">Last updated: 2025-01-01</p>

    <h2>1. Acceptance of Terms</h2>
    <p>
      By accessing or using the Valorant Tournament Hosting Framework (&ldquo;Service&rdquo;), you agree
      to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms,
      do not use the Service.
    </p>

    <h2>2. Eligibility</h2>
    <p>
      You must be at least 16 years old (or the minimum age required in your jurisdiction) to register
      an account. By registering, you represent that you meet this requirement or that you have
      obtained parental or guardian consent where required.
    </p>

    <h2>3. Account Linking &amp; Third-Party Services</h2>
    <p>
      The Service requires you to link a Discord account and a Riot Games account via their respective
      OAuth2 sign-in flows. You must comply with Discord&rsquo;s and Riot Games&rsquo; individual Terms of
      Service when using those platforms. We are not responsible for the terms, privacy practices, or
      content of any third-party service.
    </p>

    <h2>4. User Conduct</h2>
    <p>You agree not to:</p>
    <ul>
      <li>Use the Service for any unlawful purpose or in violation of any regulations.</li>
      <li>Impersonate any person or entity or misrepresent your identity or affiliation.</li>
      <li>Attempt to gain unauthorised access to the Service or its related systems.</li>
      <li>Use scripts, bots, or automation tools to interact with the Service without authorisation.</li>
      <li>Engage in any conduct that restricts or inhibits anyone&rsquo;s use or enjoyment of the Service.</li>
    </ul>

    <h2>5. Tournament Rules</h2>
    <p>
      Participation in tournaments is subject to the specific rules published for each tournament.
      Tournament organisers reserve the right to disqualify players for rule violations, abuse, or
      unsportsmanlike conduct.
    </p>

    <h2>6. Intellectual Property</h2>
    <p>
      All content and software comprising the Service are the property of their respective owners.
      Valorant, Riot Games, and associated marks are trademarks of Riot Games, Inc. This Service is
      not endorsed by or affiliated with Riot Games.
    </p>

    <h2>7. Disclaimers &amp; Limitation of Liability</h2>
    <p>
      The Service is provided &ldquo;as is&rdquo; without warranties of any kind. To the fullest extent
      permitted by law, we disclaim all liability for any damages arising from your use of the Service,
      including but not limited to loss of data or tournament results.
    </p>

    <h2>8. Termination</h2>
    <p>
      We reserve the right to suspend or terminate your access to the Service at any time for violation
      of these Terms or for any other reason at our sole discretion.
    </p>

    <h2>9. Changes to Terms</h2>
    <p>
      We may update these Terms from time to time. Continued use of the Service after changes are
      posted constitutes acceptance of the revised Terms.
    </p>

    <h2>10. Contact</h2>
    <p>
      If you have questions about these Terms, please contact the tournament administrator through the
      official Discord server.
    </p>
  </main>
  ${RIOT_LEGAL_FOOTER_HTML}
</body>
</html>`;
  }

  getPrivacyPolicyHtml(): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Privacy Policy &mdash; Valorant Tournament Hosting Framework</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <header>
    <a href="/auth/register">&larr; Back to Registration</a>
  </header>
  <main>
    <h1>Privacy Policy</h1>
    <p class="updated">Last updated: 2025-01-01</p>

    <h2>1. Introduction</h2>
    <p>
      This Privacy Policy describes how Valorant Tournament Hosting Framework (&ldquo;we&rdquo;,
      &ldquo;us&rdquo;, or &ldquo;our&rdquo;) collects, uses, and shares personal information when you
      register for and participate in tournaments through our Service.
    </p>

    <h2>2. Information We Collect</h2>
    <p>When you register, we collect the following data via OAuth2 authorisation flows:</p>
    <ul>
      <li><strong>Discord Identity:</strong> Discord User ID (Snowflake), Discord username.</li>
      <li>
        <strong>Riot Games Identity:</strong> Riot account PUUID, Riot ID (game name + tag line)
        obtained from the Riot Games Sign-On (RSO) API.
      </li>
      <li>
        <strong>Gameplay &amp; Match Data:</strong> Tournament match results and player statistics
        retrieved from the Riot Games API (VAL-MATCH-V1) using your registered PUUID.
      </li>
      <li><strong>Privacy Consent:</strong> A record of your explicit opt-in consent.</li>
    </ul>
    <p>We do not collect passwords, payment information, or sensitive personal data.</p>

    <h2>3. How We Use Your Information</h2>
    <p>Your data is used to:</p>
    <ul>
      <li>Identify you as a unique player across Discord and Riot Games platforms.</li>
      <li>Display your Riot ID and match statistics on public tournament brackets and leaderboards.</li>
      <li>Verify match results automatically through the Riot Games API.</li>
      <li>Automate Discord voice channel management during tournament matches.</li>
    </ul>

    <h2>4. Public Visibility of Data</h2>
    <p>
      <strong>By registering with your explicit consent</strong>, the following information will be made
      publicly visible within the tournament context:
    </p>
    <ul>
      <li>Your Riot ID (game name and tag line).</li>
      <li>Your player statistics and match results within the tournament.</li>
      <li>Your Discord username as it appears on brackets and team rosters.</li>
    </ul>
    <p>
      Your Discord User ID (Snowflake) and Riot account PUUID are internal identifiers and are
      <strong>not</strong> publicly displayed.
    </p>

    <h2>5. Data Sharing &amp; Third Parties</h2>
    <p>
      We do not sell your personal data. We share data only as required to operate the Service:
    </p>
    <ul>
      <li>
        <strong>Riot Games API:</strong> We access the Riot Games API to retrieve match data associated
        with your PUUID. This is subject to
        <a href="https://developer.riotgames.com/policies/general" target="_blank" rel="noopener noreferrer">Riot Games&rsquo; Developer Policies</a>.
      </li>
      <li>
        <strong>Discord API:</strong> We interact with the Discord API to manage voice channels and
        read user identity. This is subject to
        <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer">Discord&rsquo;s Privacy Policy</a>.
      </li>
    </ul>

    <h2>6. Data Retention</h2>
    <p>
      We retain your linked identity (Discord + Riot) for the duration of your participation in
      tournaments. You may request deletion of your data at any time by contacting the tournament
      administrator. Deletion will remove your account from our database, though historical match
      records may be retained in anonymised form.
    </p>

    <h2>7. Your Rights</h2>
    <p>Depending on your jurisdiction, you may have the right to:</p>
    <ul>
      <li>Access the personal data we hold about you.</li>
      <li>Request correction of inaccurate data.</li>
      <li>Request deletion of your data (right to erasure).</li>
      <li>Withdraw your consent to data processing at any time.</li>
    </ul>
    <p>To exercise these rights, contact the tournament administrator through the official Discord server.</p>

    <h2>8. Security</h2>
    <p>
      We implement reasonable technical and organisational measures to protect your data, including
      HTTPS enforcement for all OAuth2 callback routes and storage of credentials as environment
      variables (never hardcoded). However, no method of transmission over the internet is 100% secure.
    </p>

    <h2>9. Riot Games Developer Policy Compliance</h2>
    <p>
      This Service uses the Riot Games API in compliance with the
      <a href="https://developer.riotgames.com/policies/general" target="_blank" rel="noopener noreferrer">Riot Games Developer Policies</a>.
      We collect only the data necessary for tournament administration and store it only for as long as
      necessary.
    </p>

    <h2>10. Changes to This Policy</h2>
    <p>
      We may update this Privacy Policy from time to time. We will notify registered participants of
      significant changes via the official Discord server.
    </p>

    <h2>11. Contact</h2>
    <p>
      For privacy-related enquiries or data requests, please contact the tournament administrator
      through the official Discord server.
    </p>
  </main>
  ${RIOT_LEGAL_FOOTER_HTML}
</body>
</html>`;
  }
}
