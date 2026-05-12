import { ComingSoon } from '@/components/coming-soon';

export default function ChatIaPage() {
  return (
    <ComingSoon
      title="Chat IA"
      description="Tu asistente personal 24/7 que conoce tu negocio."
      planRequired="Premium"
      features={[
        'Pregunta sobre tus ingresos, citas, clientes',
        'Crea citas con lenguaje natural',
        'Sugiere mejoras basadas en tus datos',
        'Disponible siempre, en español',
      ]}
    />
  );
}
