export enum DurationPreset {
    H1 = '1H',
    H6 = '6H',
    H12 = '12H',
    D1 = '1D',
    D3 = '3D',
    W1 = '1W',
    W2 = '2W',
    M1 = '1M',
    M2 = '2M',
    M3 = '3M',
    M6 = '6M',
    Y1 = '1Y'
}

export enum TargetType {
    Product = 'Product',
    Agent = 'Agent'
}

export enum NavTab {
    LicenseKeys = 'License Keys',
    FileManager = 'File Manager',
    Products = 'Products',
    Agents = 'Agents',
    SystemLogs = 'System Logs'
}

export interface StatsData {
    id: string;
    label: string;
    subLabel: string;
    value: string;
    subValue: string;
    subValueLabel: string;
    icon: string;
    active?: boolean;
}