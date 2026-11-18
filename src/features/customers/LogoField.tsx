import type { Customer } from '@/lib/model/types'
import { CustomerAvatar } from '@/components/ui/misc'
import { ImageDropField } from '@/components/ui/ImageDropField'

/** Upload, drop or paste (Ctrl+V) a customer logo. */
export function LogoField({
  customer,
  onChange,
}: {
  customer: Customer
  onChange: (logo: string | undefined) => void
}) {
  return (
    <ImageDropField
      ariaLabel="Customer logo"
      hasImage={Boolean(customer.logo)}
      onChange={onChange}
      preview={
        <CustomerAvatar
          name={customer.name}
          shortName={customer.shortName}
          color={customer.color}
          logo={customer.logo}
          size={56}
        />
      }
    />
  )
}
