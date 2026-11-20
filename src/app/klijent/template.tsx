import { PageTransition } from "@/components/shell/page-transition";

/** Re-mounts on every navigation, so each page fades in softly. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
