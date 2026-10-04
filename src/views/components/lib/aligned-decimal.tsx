import { asExactDecimal, decimalPadding } from '../../../utils/format'

// Needs tabular figures on an ancestor, so that a hidden zero is as wide as any digit.
export default function AlignedDecimal({ value, digits }: { value: string, digits: number }) {
   return (
      <>
         {asExactDecimal(value)}
         <span className="invisible">{decimalPadding(value, digits)}</span>
      </>
   )
}
