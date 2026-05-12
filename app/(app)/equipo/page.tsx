import { ComingSoon } from '@/components/coming-soon';

export default function EquipoPage() {
  return (
    <ComingSoon
      title="Equipo"
      description="Gestiona hasta 5 colaboradores con horarios y citas individuales."
      planRequired="Luxury"
      features={[
        'Cada colaborador con sus propios horarios',
        'Citas simultáneas en cabinas distintas',
        'Reportes consolidados y por persona',
        'Bloqueos de tiempo individuales',
      ]}
    />
  );
}
