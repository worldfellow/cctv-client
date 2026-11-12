// Display label for a college: "Name, Location" (location = college address), or just the name
export function collegeLabel(college: { name?: string; address?: string | null } | null | undefined): string {
    if (!college) return '';
    const name = (college.name || '').trim();
    const location = (college.address || '').trim();
    return location ? `${name}, ${location}` : name;
}
