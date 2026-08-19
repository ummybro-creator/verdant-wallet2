import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card, SectionTitle } from "@/components/ui-kit/Card";

export function InfoPage({
  title,
  intro,
  sections,
  footer,
}: {
  title: string;
  intro?: string;
  sections: { heading: string; body: string }[];
  footer?: React.ReactNode;
}) {
  return (
    <MobileShell>
      <Header title={title} />
      <div className="space-y-3 p-3">
        {intro && (
          <Card className="p-4">
            <p className="text-[13px] leading-relaxed text-muted-foreground">{intro}</p>
          </Card>
        )}
        {sections.map((s, i) => (
          <Card key={s.heading} delay={i * 0.05} className="space-y-2 p-4">
            <SectionTitle>{s.heading}</SectionTitle>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
          </Card>
        ))}
        {footer}
      </div>
    </MobileShell>
  );
}
