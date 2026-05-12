import { ComingSoon } from '@/components/coming-soon';

export default function ReportesPage() {
  return (
    <ComingSoon
      title="Reportes ejecutivos"
      description="Vista expandida de tus métricas con análisis profundo y exportación."
      features={[
        'Comparativas mes a mes y año tras año',
        'Análisis por categoría de servicio',
        'Reportes por colaborador (Luxury)',
        'Exportación a CSV y PDF',
        'Filtros avanzados por fecha y segmento',
      ]}
    />
  );
}
