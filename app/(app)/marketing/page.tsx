import { ComingSoon } from '@/components/coming-soon';

export default function MarketingPage() {
  return (
    <ComingSoon
      title="Marketing"
      description="Campañas automáticas que regresan a tus clientes al sillón."
      planRequired="Luxury"
      features={[
        'Mensajes de cumpleaños automáticos',
        'Recuperación de clientes inactivos (60+ días)',
        'Campañas masivas a segmentos específicos',
        'Métricas de aperturas y conversiones',
      ]}
    />
  );
}
