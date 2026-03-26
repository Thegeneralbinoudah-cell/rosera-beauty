import { Heart } from 'lucide-react'
import type { RozyVisionPersonalizationV1 } from '@/lib/rozyVisionPersonalization'
import { ResultCard } from '@/components/rozy-vision/ResultCard'

const undertoneLabel: Record<string, string> = {
  warm: 'دافئ',
  cool: 'بارد',
  neutral: 'محايد',
  uncertain: 'غير محدد',
}

const faceLabel: Record<string, string> = {
  oval: 'بيضاوي',
  round: 'مستدير',
  square: 'مربّع',
  heart: 'قلب',
  uncertain: 'غير محدد',
}

type Props = {
  data: RozyVisionPersonalizationV1
}

export function RozyVisionRememberCard({ data }: Props) {
  const hasPrefs =
    (data.undertone && data.undertone !== 'uncertain') ||
    (data.face_shape && data.face_shape !== 'uncertain') ||
    data.preferred_styles.length > 0 ||
    data.history.length > 0

  if (!hasPrefs) return null

  return (
    <ResultCard variant="soft" title="روزي تتذكركِ">
      <div className="flex items-start gap-2 text-body leading-relaxed text-foreground">
        <Heart className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-2">
          {data.undertone && data.undertone !== 'uncertain' ? (
            <p>
              <span className="font-semibold text-primary">إنديرتونكِ المفضّل: </span>
              {undertoneLabel[data.undertone] ?? data.undertone}
            </p>
          ) : null}
          {data.face_shape && data.face_shape !== 'uncertain' ? (
            <p>
              <span className="font-semibold text-primary">شكل الوجه المحفوظ: </span>
              {faceLabel[data.face_shape] ?? data.face_shape}
            </p>
          ) : null}
          {data.preferred_styles.length > 0 ? (
            <p>
              <span className="font-semibold text-primary">أسلوب وألوان تفضّلينها: </span>
              {data.preferred_styles.slice(0, 8).join(' · ')}
            </p>
          ) : null}
          {data.history.length > 0 ? (
            <p className="text-caption text-muted-foreground">
              {data.history.length} جلسة في تاريخكِ — الاقتراحات تصبح أدق مع الوقت.
            </p>
          ) : null}
          <p className="text-caption text-muted-foreground">
            نستخدم هذا لاقتراحات أوضح في كل مرة — يمكنكِ تحديثه بتحليل جديد.
          </p>
        </div>
      </div>
    </ResultCard>
  )
}
