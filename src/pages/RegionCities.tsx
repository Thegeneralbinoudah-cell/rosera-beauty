import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/hooks/useI18n'
import { usePreferences } from '@/contexts/PreferencesContext'
import { useCities } from '@/hooks/useCities'
import { colors } from '@/theme/colors'

export default function RegionCities() {
  const { t } = useI18n()
  const { lang } = usePreferences()
  const { regionId } = useParams()
  const { regionName, regionImage, cities, loading } = useCities(regionId, lang)

  return (
    <div className="min-h-dvh bg-rosera-light pb-28 dark:bg-rosera-dark">
      <div className="relative h-44 overflow-hidden">
        {regionImage && <img src={regionImage} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-rosera-light dark:from-rosera-dark to-transparent" />
        <div className="absolute bottom-4 start-4 end-4">
          <Link
            to="/home"
            className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-white drop-shadow hover:opacity-95"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {t('region.home')}
          </Link>
          <h1 className="text-2xl font-extrabold text-white drop-shadow-md">{regionName || '...'}</h1>
          <p className="mt-1 text-sm text-white">{t('region.chooseCity')}</p>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : cities.length === 0 ? (
          <p className="py-12 text-center text-rosera-gray">{t('region.noCities')}</p>
        ) : (
          <ul className="space-y-3">
            {cities.map((city, i) => (
              <motion.li
                key={city.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24, delay: Math.min(i * 0.025, 0.6) }}
              >
                <Link
                  to={`/city/${city.id}`}
                  className="flex items-center justify-between rounded-2xl border border-primary/15 bg-gradient-to-l from-white via-transparent p-4 shadow-sm ring-1 ring-primary/30 transition hover:shadow-[0_12px_28px_-12px_rgb(212_165_165_/_0.25)] dark:from-card dark:via-card dark:to-card dark:ring-primary/10"
                  style={{
                    backgroundImage: `linear-gradient(to left, white, ${colors.surface}, color-mix(in srgb, ${colors.primary} 50%, transparent))`,
                  }}
                >
                  <div>
                    <p className="font-bold text-foreground">{city.name_ar}</p>
                    <p className="text-sm font-medium text-foreground">
                      {city.salonCount}{' '}
                      {city.salonCount === 1 ? t('region.salonOne') : t('region.salonMany')}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-primary rtl:rotate-180" />
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
