import { pgSql } from '@/lib/db'

export default async function getCommunityIndex(req, res) {
   const communityIndices = (await pgSql`select * from community_indices`)
      .map(e => ({
         date: e.date.getTime(),
         value: e.value,
      }))

   res.status(200).json({ communityIndices })
}
