import React, { useState, useEffect } from "react";

// Define prop types
interface VerbositySliderProps {
    // --- Renamed prop to match parent component ---
    onExplanationLevelChange: (level: number) => void;
    initialValue?: number; // Optional prop to set the initial level
}

// Map levels (1-4) to names
const verbosityLevels: { [key: number]: string } = {
    1: "Concise",
    2: "Detailed",
    3: "Elaborate",
    4: "Comprehensive"
};

const VerbositySlider: React.FC<VerbositySliderProps> = ({
    // --- Use the new prop name ---
    onExplanationLevelChange,
    initialValue = 2 // Default to level 2 (Detailed) if no initialValue is provided
}) => {
    // --- State now uses the 1-4 range ---
    const [currentLevel, setCurrentLevel] = useState<number>(initialValue);

    // Ensure initial value is passed up on mount if different from default
    useEffect(() => {
        if (initialValue !== undefined) {
            onExplanationLevelChange(initialValue);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only once on mount


    const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newLevel = Number(event.target.value); // Value will be 1, 2, 3, or 4
        setCurrentLevel(newLevel);

        // --- Call the renamed prop function ---
        onExplanationLevelChange(newLevel); // Notify parent
    };

    return (
        <div className="w-100 mb4"> {/* Added margin-bottom */}
            <label className="f5 db mb2" htmlFor="explanation-level-slider">
                Select Explanation Level: <span className='fw6'>{verbosityLevels[currentLevel] || 'Detailed'}</span> {/* Display name */}
            </label>
            {/* Removed the dark background div for potentially better integration */}
            <input
                type="range"
                // --- Changed min/max to match 1-4 range ---
                min="1"
                max="4"
                step="1" // Ensure integer steps
                value={currentLevel} // Use the 1-4 state
                onChange={handleSliderChange}
                className="w-100 slider" // Keep slider class if you have custom styles
                id="explanation-level-slider" // Added id for label association
            />
            {/* Display the level name below the slider */}
            {/* Optional: Add markings for 1, 2, 3, 4 below the slider */}
            <div className="flex justify-between w-100 mt1 f6 tc gray">
                <span>Concise</span>
                {/* Add labels for intermediate steps if desired */}
                <span>Comprehensive</span>
            </div>
            {/* Or just show the selected level name */}
            {/* <div className="tc mt2 f5 fw5">{verbosityLevels[currentLevel]}</div> */}
        </div>
    );
};

export default VerbositySlider;
