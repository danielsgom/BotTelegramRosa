import { Card, Flex, Skeleton, Box } from '@radix-ui/themes'

interface Props {
  lines?: number
}

export default function LoadingCard({ lines = 4 }: Props) {
  return (
    <Card>
      <Flex direction="column" gap="3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} height="20px" width={i === 0 ? '40%' : '100%'} />
        ))}
      </Flex>
    </Card>
  )
}
