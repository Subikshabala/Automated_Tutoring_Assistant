'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { QuestionDto } from '@/lib/schemas/assessment'

export function QuestionCard({
  question,
  index,
  value,
  onChange,
}: {
  question: QuestionDto
  index: number
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Question {index + 1}
          </CardTitle>
          <Badge variant="outline">{question.conceptName}</Badge>
        </div>
        <p className="text-base leading-relaxed">{question.prompt}</p>
      </CardHeader>

      <CardContent>
        {question.type === 'MCQ' ? (
          <RadioGroup value={value} onValueChange={onChange} className="gap-2">
            {question.options.map((option) => (
              <Label
                key={option}
                className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-200 hover:bg-accent hover:border-primary/40 cursor-pointer font-normal"
              >
                <RadioGroupItem value={option} />
                <span className="flex-1">{option}</span>
              </Label>
            ))}
          </RadioGroup>
        ) : (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write your answer in your own words..."
            rows={4}
            className="resize-none"
          />
        )}
      </CardContent>
    </Card>
  )
}
