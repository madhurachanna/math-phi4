import React, { useState, useEffect } from "react";

interface VerbositySliderProps {
    onExplanationLevelChange: (level: number) => void;
    initialValue?: number;
}

const verbosityLevels: { [key: number]: string } = {
    1: "Concise",
    2: "Detailed",
    3: "Elaborate",
    4: "Comprehensive"
};

const VerbositySlider: React.FC<VerbositySliderProps> = ({
    onExplanationLevelChange,
    initialValue = 2
}) => {
    const [currentLevel, setCurrentLevel] = useState<number>(initialValue);

    useEffect(() => {
        if (initialValue !== undefined) {
            onExplanationLevelChange(initialValue);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newLevel = Number(event.target.value);
        setCurrentLevel(newLevel);
        onExplanationLevelChange(newLevel);
    };

    return (
        <div className="w-100 mb4">
            <label className="f5 db mb2" htmlFor="explanation-level-slider">
                Select Explanation Level: <span className='fw6'>{verbosityLevels[currentLevel] || 'Detailed'}</span>
            </label>
            <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={currentLevel}
                onChange={handleSliderChange}
                className="w-100 slider"
                id="explanation-level-slider"
            />
            <div className="flex justify-between w-100 mt1 f6 tc gray">
                <span>Concise</span>
                <span>Comprehensive</span>
            </div>
        </div>
    );
};

export default VerbositySlider;
