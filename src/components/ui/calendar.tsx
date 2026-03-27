import { DayPicker, type DayPickerProps } from 'react-day-picker'
import { arSA } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import 'react-day-picker/style.css'

export type CalendarProps = DayPickerProps

/** تقويم shadcn-style مع دعم RTL وعربي */
function Calendar({ className, ...props }: CalendarProps) {
  return (
    <div className={cn('rosera-calendar rounded-2xl border border-border bg-card p-2 shadow-sm dark:bg-card', className)} dir="rtl">
      <DayPicker locale={arSA} dir="rtl" {...props} />
    </div>
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
